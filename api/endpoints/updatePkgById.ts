import express, { Request, Response } from "express";
import { query } from "../database";
import { verifyToken } from "../common";
import axios from "axios";
import path from 'path';
import dotenv from 'dotenv';
const dotenvPath = path.join(__dirname, '..','..', '.env');
dotenv.config({ path: dotenvPath });
const defaultUsername = 'ece30861defaultadminuser';
async function updatePkgById(req: Request, res: Response) {
    const token = req.headers['x-authorization'] as string;
    let decoded = null;
    try {
        decoded = await verifyToken(token);
    } catch (err) {
        console.error(err);
        return res.sendStatus(400);
    }
    if (!req.body.metadata || !req.body.data) {
        console.error('Invalid request body metadata or data');
        return res.sendStatus(400);
    } 
    if (!req.body.metadata.ID || !req.body.metadata.Name || !req.body.metadata.Version) {
        console.error('Invalid request body in the metadata');
        return res.sendStatus(400);
    }
    if (req.body.data.Content && req.body.data.URL) {
        console.error('Invalid request body in the data both content and url');
        return res.sendStatus(400)
    }
    if (!req.body.data.Content && !req.body.data.URL) {
        console.error('Invalid request body in the data no content and url');
        return res.sendStatus(400)
    }
    const username = defaultUsername;
    const metadata = req.body.metadata
    const data = req.body.data
    const jsprogram = data.JSProgram || null
    const pkg_name = metadata.Name
    const pkg_version = metadata.Version
    const pkg_id = metadata.ID
    if (req.params.id !== pkg_id) return res.sendStatus(400)
    const pkg = await query('SELECT * FROM packages WHERE package_id = $1 AND package_name = $2 AND package_version = $3', [pkg_id, pkg_name, pkg_version])
    if (pkg.rowCount && pkg.rowCount === 0) return res.sendStatus(404)
    if (data.Content) {
        if (!isValidBase64(data.Content)) return res.sendStatus(400)
        const buffer = Buffer.from(data.Content, "base64");
        await query('UPDATE packages SET package_zip = $1, jsprogram = $2 WHERE package_id = $3 AND package_name = $4 AND package_version = $5', [buffer, jsprogram, pkg_id, pkg_name, pkg_version])
        await query('INSERT INTO packagehistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkg_name, username, 'UPDATE', pkg_id]);
        return res.sendStatus(200);
    } else {
        if (data.URL.includes('github.com')) {
            const ownerRepo = data.URL.split('github.com/')[1].split('.git')[0];
            let response = null
            try {
              const repoInfo = await axios.get(`https://api.github.com/repos/${ownerRepo}`, {
                headers:{
                  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
                }
              })
              const defaultBranch = repoInfo.data.default_branch;
              response = await axios.get('https://github.com' + `/${ownerRepo}` + `/archive/${defaultBranch}.zip`, { responseType: 'arraybuffer' })
            } catch (err){
              console.error(err);
              return res.sendStatus(400);
            }
            if (!response.data) return res.sendStatus(400);
            const bytea = Buffer.from(response.data, 'binary')
            await query('UPDATE packages SET package_zip = $1, jsprogram = $2 WHERE package_id = $3 AND package_name = $4 AND package_version = $5', [bytea, jsprogram, pkg_id, pkg_name, pkg_version])
            await query('INSERT INTO packagehistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkg_name, username, 'UPDATE', pkg_id]);
            return res.sendStatus(200);
        } else if (data.URL.includes('npmjs.com')) {
            const packageInfo = extractPackageNameAndVersion(data.URL);
            let npmPackageInfo = null;
            if (!packageInfo) {
              console.error('Invalid npm link');
              return res.sendStatus(400);
            }
            try {
                npmPackageInfo = await axios.get(`https://registry.npmjs.org/${packageInfo.packageName}`);
              } catch (err) {
                console.error(err);
                return res.sendStatus(400);
              }
              if (!npmPackageInfo.data) {
                console.error('Invalid npm link');
                return res.sendStatus(400);
              }
              const repoUrl = npmPackageInfo.data.repository.url;
              if (!repoUrl) {
                console.error('Invalid npm link');
                return res.sendStatus(400);
              }
            const ownerRepo = repoUrl.split('github.com/')[1].split('.git')[0];
            //get the zip file for the version
            let zipdata = null
            if (!packageInfo.version) {
                try {
                  const repoInfo = await axios.get(`https://api.github.com/repos/${ownerRepo}`, {
                    headers:{
                      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
                    }
                  })
                  const defaultBranch = repoInfo.data.default_branch;
                  zipdata = await axios.get('https://github.com' + `/${ownerRepo}` + `/archive/${defaultBranch}.zip`, { responseType: 'arraybuffer' })
                } catch (err){
                  console.error(err);
                  return res.sendStatus(400);
                }
              } else {
                try {
                  zipdata = await axios.get('https://github.com' + `/${ownerRepo}` + `/archive/${packageInfo.version}.zip`, { responseType: 'arraybuffer' })
                  
                } catch (err){
                  try {
                    zipdata = await axios.get('https://github.com' + `/${ownerRepo}` + `/archive/v${packageInfo.version}.zip`, { responseType: 'arraybuffer' })  
                  } catch (err) {
                    console.error(err);
                    return res.sendStatus(400);
                  }
                }
              }
            if (!zipdata) {
                console.error('Invalid npm link, cannot get the zip file');
                return res.sendStatus(400);
            }
            if (!zipdata.data) {
                console.error('Invalid npm link, cannot get the zip file data not present');
                return res.sendStatus(400);
            }
            const bytea = Buffer.from(zipdata.data, 'binary')
            await query('UPDATE packages SET package_zip = $1, jsprogram = $2 WHERE package_id = $3 AND package_name = $4 AND package_version = $5', [bytea, jsprogram, pkg_id, pkg_name, pkg_version])
            await query('INSERT INTO packagehistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkg_name, username, 'UPDATE', pkg_id]);
            return res.sendStatus(200);
        }
        
    }
}

  
function isValidBase64(str: string): boolean {
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    return base64Regex.test(str);
}
function parseUrl(url: string): string[] {
  const endpoint1 = url + '/archive/master.zip'
  const endpoint2 = url + '/archive/main.zip' 
  return [endpoint1, endpoint2]
}
function extractPackageNameAndVersion(npmLink: string): { packageName: string, version: string | null } | null {
    // Define the common parts of the URL
    const baseUrl = 'https://www.npmjs.com/package/';
    const versionPrefix = '/v/';
    // Check if the URL starts with the base URL
    if (npmLink.startsWith(baseUrl)) {
      // Remove the base URL
      const withoutBaseUrl = npmLink.substring(baseUrl.length);
      // Find the index of the version prefix
      const versionIndex = withoutBaseUrl.indexOf(versionPrefix);
      if (versionIndex !== -1) {
        // If version prefix is found, extract the package name and version
        const packageName = withoutBaseUrl.substring(0, versionIndex);
        const version = withoutBaseUrl.substring(versionIndex + versionPrefix.length);
        return { packageName, version };
      } else {
        // If version prefix is not found, extract only the package name and set version to null
        return { packageName: withoutBaseUrl, version: null };
      }
    }
    // Return null if the URL format is not as expected
    return null;
}

export default updatePkgById;