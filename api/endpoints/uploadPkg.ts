import express, { Request, Response } from "express";
import * as crypto from "crypto";
import { query } from "../database";
import { verifyToken } from "../common";
import AdmZip from "adm-zip";
import fs, { read } from "fs";
import path from "path";
import axios from "axios";
import terser, {} from "terser";
import {exec} from 'child_process';
import { rimrafSync } from 'rimraf';
const jsonminify = require('jsonminify')
import dotenv from 'dotenv';
const dotenvPath = path.join(__dirname, '..','..', '.env');
dotenv.config({ path: dotenvPath });
const rootPath = path.join(__dirname, '..');
const defaultUsername = 'ece30861defaultadminuser';
async function uploadPackage(req: Request, res: Response) {
  const request = req.body;
  const token = req.headers['x-authorization'] as string;
  const enable_debloat = req.query['debloat-enabled'] === 'true' || false;
  const jsprogram = req.body.JSProgram || null;
  //if the token is not valid, return 400
  let decoded = null;
  try {
     decoded = await verifyToken(token);
   } catch (err) {
     console.error(err);
     return res.sendStatus(400);
   }
  if (!decoded) return res.sendStatus(400)
  const username = defaultUsername;
  //check the request body, content and url
  if ((request.Content && request.URL) || (!request.Content && !request.URL)) return res.sendStatus(400);
  //upload with encoded content
  if (request.Content) {
    if (!isValidBase64(request.Content)) {
      console.error('Invalid base64 string');
      return res.sendStatus(400);
    }
    //handle the file
    const buffer = Buffer.from(request.Content, "base64");
    fs.writeFileSync(path.join(rootPath, 'upload.zip'), buffer);
    try {
      await unzipFile(path.join(rootPath, 'upload.zip'), path.join(rootPath, 'uploads'));
    } catch (err) {
      console.error(err);
      cleanUp();
      return res.sendStatus(400);
    }
    const packageJsonFilePath = getPackageJsonFilePathRecursive(path.join(rootPath, 'uploads'));
    if (!packageJsonFilePath) {
      cleanUp();
      return res.sendStatus(400);
    }
    const pkgInfo = parsePackageJson(packageJsonFilePath);
    if (!pkgInfo.url) return res.sendStatus(400);
    //if the version is not specified, get the latest release
    if (!pkgInfo.name) {
      const parts = pkgInfo.url.split('/');
      const repositoryName = parts[parts.length - 1];
      pkgInfo.name = repositoryName.replace('.git', '');
    }
    if (!pkgInfo.version) {
      pkgInfo.version = await getLatestReleaseUrl(pkgInfo.url);
    }
    if (!pkgInfo.version) {
      console.error('Invalid github link, cannot get the latest release');
      return res.sendStatus(400);
    }
    if (!pkgInfo.id) {
      pkgInfo.id = getPackageId(pkgInfo.name, pkgInfo.version);
    }
    if (!pkgInfo.id) {
      console.error('Invalid package name and version');
      return res.sendStatus(400);
    }
    //check if the package is already in the database
    const pkg = await query('SELECT * FROM Packages WHERE package_id = $1', [pkgInfo.id]);
    //return 409 if the package is already in the database
    if (pkg.rowCount && pkg.rowCount > 0) {
       cleanUp();
       return res.sendStatus(409);
    }
    //GET THE readme file
    const readmeFilePath = getReadmeFilePathRecursive(path.join(rootPath, 'uploads'));
    let readmeContent = null;
    if (readmeFilePath) readmeContent = fs.readFileSync(readmeFilePath, 'utf-8');
    //debloat feature
    if (enable_debloat){
      await processFolder(path.join(rootPath, 'uploads'));
      const encodezip = await zipAndEncodeFolder(path.join(rootPath, 'uploads'));
      const debloatbuffer = Buffer.from(encodezip, 'base64');
      //insert the package into the database
      const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme ) VALUES($1, $2, $3, $4, $5, $6, $7)', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, debloatbuffer, readmeContent]);
      const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
      debloatCleanUp();
      const payload = getPayload(pkgInfo, jsprogram);
      payload.data.Content = encodezip.toString();
      return res.status(201).send(payload);
    } else {
      const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme ) VALUES($1, $2, $3, $4, $5, $6, $7)', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, buffer, readmeContent]);
      const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
      cleanUp();
      const payload = getPayload(pkgInfo, jsprogram);
      payload.data.Content = request.Content;
      return res.status(201).send(payload);
    }
  } else if (request.URL) {
    if (request.URL.includes('npmjs.com')) {
      // it is a npm link
      // will need to rate the package
      // fs.writeFileSync(`${__dirname}/../one-url.txt`, request.URL);
      // const rate = await runTsc();
      // const jsonrate = JSON.parse(rate);
      // let isIngestable = true
      // Object.entries(jsonrate).forEach(([key, value]) => {
      //   if (key != 'URL' && key != 'NET_SCORE') {
      //     const score = parseFloat(value as string);
      //     if (score < 0.5) isIngestable = false
      //   }
      // })
      // if (!isIngestable) return res.sendStatus(424);
      const packageInfo = extractPackageNameAndVersion(request.URL);
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
      // get the default branch
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
      fs.writeFileSync(path.join(rootPath, 'upload.zip'), zipdata.data);
      try {
        await unzipFile(path.join(rootPath, 'upload.zip'), path.join(rootPath, 'uploads'));
      } catch (err) {
        console.error(err);
        cleanUp();
        return res.sendStatus(400);
      }
      let pkgInfo = null;
      if (packageInfo.version) {
        const packageJsonFilePath = getPackageJsonFilePathRecursive(path.join(rootPath, 'uploads'));
        if (!packageJsonFilePath) {
          console.error('Invalid github link no package.json');
          cleanUp();
          return res.sendStatus(400);
        }
        pkgInfo = parsePackageJson(packageJsonFilePath);
        if (!pkgInfo.url) {
          pkgInfo.url = repoUrl
        }
        if (!pkgInfo.version) {
          pkgInfo.version = packageInfo.version;
        }
        if(!pkgInfo.name) {
          pkgInfo.name = packageInfo.packageName;
        }
        if(!pkgInfo.id) {
          pkgInfo.id = getPackageId(pkgInfo.name, pkgInfo.version);
        }
      } else {
        const packageJsonFilePath = getPackageJsonFilePathRecursive(path.join(rootPath, 'uploads'));
        if (!packageJsonFilePath) {
          cleanUp();
          return res.sendStatus(400);
        }
        pkgInfo = parsePackageJson(packageJsonFilePath);
        if (!pkgInfo.url) {
          pkgInfo.url = repoUrl
        }
        //if the version is not specified, get the latest release
        if(!pkgInfo.version) {
          pkgInfo.version = await getLatestReleaseUrl(pkgInfo.url);
        }
        if (!pkgInfo.version) {
          console.error('Invalid github link, cannot get the latest release');
          cleanUp();
          return res.sendStatus(400);
        }
        if(!pkgInfo.name) {
          pkgInfo.name = packageInfo.packageName;
        }
        if(!pkgInfo.id) {
          pkgInfo.id = getPackageId(pkgInfo.name, pkgInfo.version);
        }
      }
      if (!pkgInfo) {
        cleanUp();
        return res.sendStatus(400);
      }
      const pkg = await query('SELECT * FROM packages WHERE package_id = $1', [pkgInfo.id]);
      if (pkg.rowCount && pkg.rowCount > 0) {
        cleanUp();
        return res.sendStatus(409);
      }
      const readmeFilePath = getReadmeFilePathRecursive(path.join(rootPath, 'uploads'));
      let readmeContent = null;
      if (readmeFilePath) readmeContent = fs.readFileSync(readmeFilePath, 'utf-8');
      //debloat feature
      if (enable_debloat) {
        await processFolder(path.join(rootPath, 'uploads'));
        const encodezip = await zipAndEncodeFolder(path.join(rootPath, 'uploads'));
        const debloatbuffer = Buffer.from(encodezip, 'base64');
        const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme) VALUES($1, $2, $3, $4, $5, $6, $7)', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, debloatbuffer, readmeContent]);
        const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
        debloatCleanUp();
        const payload = getPayload(pkgInfo, jsprogram);
        payload.data.Content = encodezip.toString();
        return res.status(201).send(payload);
      } else {
        const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme) VALUES($1, $2, $3, $4, $5, $6, $7)', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, zipdata.data, readmeContent]);
        const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
        cleanUp();
        const payload = getPayload(pkgInfo, jsprogram);
        payload.data.Content = zipdata.data.toString('base64');
        return res.status(201).send(payload);
      }
    }
    //it is a github repo
    const ownerRepo = parseUrl(request.URL);
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
    const bytea = response.data;
    fs.writeFileSync(path.join(rootPath, 'upload.zip'), response.data);
    try {
      await unzipFile(path.join(rootPath, 'upload.zip'), path.join(rootPath, 'uploads'));
    } catch (err) {
      console.error(err);
      cleanUp();
      return res.sendStatus(400);
    }
    const packageJsonFilePath = getPackageJsonFilePathRecursive(path.join(rootPath, 'uploads'));
    if (!packageJsonFilePath) {
      cleanUp();
      return res.sendStatus(400);
    }
    const pkgInfo = parsePackageJson(packageJsonFilePath);
    if (!pkgInfo.url) {
      cleanUp();
      return res.sendStatus(400);
    }
    if (!pkgInfo.name) {
      const parts = pkgInfo.url.split('/');
      const repositoryName = parts[parts.length - 1];
      pkgInfo.name = repositoryName.replace('.git', '');
    }
    if (!pkgInfo.version) {
      pkgInfo.version = await getLatestReleaseUrl(pkgInfo.url);
    }
    if (!pkgInfo.version) {
      console.error('Invalid github link, cannot get the latest release');
      return res.sendStatus(400);
    }
    if (!pkgInfo.id) {
      pkgInfo.id = getPackageId(pkgInfo.name, pkgInfo.version);
    }
    const pkg = await query('SELECT * FROM packages WHERE package_id = $1', [pkgInfo.id]);
    if (pkg.rowCount && pkg.rowCount > 0) {
      cleanUp();
      return res.sendStatus(409);
    }
    const readmeFilePath = getReadmeFilePathRecursive(path.join(rootPath, 'uploads'));
    let readmeContent = null;
    if (readmeFilePath) readmeContent = fs.readFileSync(readmeFilePath, 'utf-8');
    //debloat feature
    if (enable_debloat) {
      await processFolder(path.join(rootPath, 'uploads'));
      const encodezip = await zipAndEncodeFolder(path.join(rootPath, 'uploads'));
      const debloatbuffer = Buffer.from(encodezip, 'base64');
      const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme ) VALUES($1, $2, $3, $4, $5, $6, $7 )', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, debloatbuffer, readmeContent]);
      const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
      debloatCleanUp();
      const payload = getPayload(pkgInfo, jsprogram);
      payload.data.Content = encodezip.toString();
      return res.status(201).send(payload);
    } else {
      const pkgInsert = await query('INSERT INTO packages (package_id, package_version, package_name, package_url, jsprogram, package_zip, package_readme ) VALUES($1, $2, $3, $4, $5, $6, $7 )', [pkgInfo.id, pkgInfo.version, pkgInfo.name, pkgInfo.url, jsprogram, bytea, readmeContent]);
      const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkgInfo.name, username, 'CREATE', pkgInfo.id]);
      cleanUp();
      const payload = getPayload(pkgInfo, jsprogram);
      payload.data.Content = bytea.toString('base64');
      return res.status(201).send(payload);
    }
    
  }
}

async function getLatestReleaseUrl(url: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      let latestReleaseTag = null;
      try {
      const parts = url.split('/');
      const owner = parts[parts.length - 2];
      const repo = parts[parts.length - 1].replace('.git', '');
      const releases = await axios.get(`https://api.github.com/repos/${owner}/${repo}/tags`);
      if (!releases.data) {
        console.error('Invalid github link, cannot get the releases');
        reject(null);
      }
      if (releases.data.length === 0) {
        console.error('Invalid github link, cannot get the releases');
        reject(null);
      }
      latestReleaseTag = releases.data[0].name;
      console.log('Latest release:',latestReleaseTag);
      resolve(latestReleaseTag)
    } catch (err) {
      console.error(err);
      reject(null);
    }
    })
}

function getPayload(pkgInfo: any, jsprogram: string) : any {
  return {
    metadata: {
      Name: pkgInfo.name,
      Version: pkgInfo.version,
      ID: pkgInfo.id
    },
    data: {
      Content: null,
      JSProgram: jsprogram
    }
  }
}
function debloatCleanUp() {
  try {
    fs.unlinkSync(path.join(rootPath, 'debloat.zip'));
    fs.unlinkSync(path.join(rootPath, 'upload.zip'));
    fs.rmSync(path.join(rootPath, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(rootPath, 'uploads'));
  } catch (err) {
    console.error(err);
  }
}
function cleanUp() {
  try {
    fs.unlinkSync(path.join(rootPath, 'upload.zip'));
    fs.rmSync(path.join(rootPath, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(rootPath, 'uploads'));
  } catch (err) {
    console.error(err);
  }
}
function parseUrl(url: string): string {
  const ownerRepo = url.split('github.com/')[1].split('.git')[0];
  return ownerRepo
}
function getPackageJsonFilePathRecursive(folderPath: string): string | null {
  const files = fs.readdirSync(folderPath);

  const packageJsonFile = files.find((file) => file === 'package.json');

  if (packageJsonFile) {
    return path.join(folderPath, packageJsonFile);
  }

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const isDirectory = fs.statSync(filePath).isDirectory();

    if (isDirectory) {
      const packageJsonPath = getPackageJsonFilePathRecursive(filePath);
      if (packageJsonPath) {
        return packageJsonPath;
      }
    }
  }
  return null;
}
function getReadmeFilePathRecursive(folderPath: string): string | null {
  const files = fs.readdirSync(folderPath);

  const readmeFile = files.find((file) => file === 'README.md');

  if (readmeFile) {
    return path.join(folderPath, readmeFile);
  }

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const isDirectory = fs.statSync(filePath).isDirectory();

    if (isDirectory) {
      const readmePath = getReadmeFilePathRecursive(filePath);
      if (readmePath) {
        return readmePath;
      }
    }
  }
  return null;
}
async function unzipFile(zipFilePath: string, destinationPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(destinationPath, true);
      console.log('Extraction completed successfully.');
      resolve();
    } catch (error) {
      console.error('Error during extraction:', error);
      reject(error);
    }
  });
}

async function zipAndEncodeFolder(folderPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      const items = fs.readdirSync(folderPath);
      const subdirectoryName = items.find(item => fs.statSync(path.join(folderPath, item)).isDirectory());
      if (!subdirectoryName) {
         throw new Error(`No subdirectories found in '${folderPath}'.`);
      }
      const subdirectoryPath = path.join(folderPath, subdirectoryName);
      const zip = new AdmZip();
      zip.addLocalFolder(subdirectoryPath);
      const zipBuffer = zip.toBuffer();
      const base64String = zipBuffer.toString('base64');
      fs.writeFileSync('debloat.zip', zipBuffer);
      resolve(base64String);
    } catch (error) {
      console.error('Error during zipping:', error);
      reject(error);
    }
  })
}

//all we know is the json file will have the url in it
//need to consider the case name is not in the json
//use the github api to get the latest release
function parsePackageJson(path: string): { name: string | null; version: string | null; url: string; id: string | null} {
  const content = fs.readFileSync(path, 'utf8');
  const packageJson = JSON.parse(content);
  const pkg_version = packageJson.version ? packageJson.version : null;
  let pkg_name = packageJson.name ? packageJson.name : null;
  const pkg_id = getPackageId(packageJson.name, packageJson.version);
  if (pkg_name) {
    if (pkg_name.includes('/')) {
      const parts = packageJson.name.split('/');
      pkg_name = parts[parts.length - 1];
    }
  }
  let pkg_url = null;
  if (packageJson.repository) {
    if (packageJson.repository.url) {
      pkg_url = packageJson.repository.url;
    }
  }
  if (pkg_url) {
    if (!pkg_url.startsWith('https://')) pkg_url = 'https://' + pkg_url.split('://')[1]
  }
  return { name: pkg_name, version: pkg_version, url: pkg_url, id: pkg_id};
}
function getPackageId(name: string, version: string): string | null {
  if (!name || !version) return null;
  const hash = crypto.createHash('sha256');
  hash.update(name + version);
  return hash.digest('hex');
}
function isValidBase64(str: string): boolean {
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Regex.test(str);
}

async function runTsc(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rootPath = path.join(__dirname, '..', '..');
    const command = 'tsc && node ./dist/src/main.js ./api/one-url.txt';

    exec(command, { cwd: rootPath }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        reject(new Error(stderr));
        return;
      }
      resolve(stdout);
    });
  });
}

async function minifyJS(filePath: string) {
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const result = await terser.minify(code);
    fs.writeFileSync(filePath, result.code as string);
  } catch (err) {
    console.error(err);
    console.error(`Error minifying ${filePath}`);
  }
}

async function processFolder(folderPath: string):Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const files = fs.readdirSync(folderPath);
      
      files.forEach(async file => {
      const filePath = path.join(folderPath, file);
      if (fs.statSync(filePath).isDirectory() && (file === '.git' || file === '.github')) {
        // If it's .git or .github, delete the entire folder using rimraf
        await deleteFolder(filePath);
      }
      else if (fs.statSync(filePath).isDirectory()) {
      // If it's a directory, recursively process it
      processFolder(filePath);
      } else if (file.endsWith('.js') && !file.endsWith('.min.js')) {
      // If it's a JavaScript file, minify it in place
        await minifyJS(filePath);
      } else if (file.endsWith('.json')) {
        await minifyJSON(filePath);
      }
      });
      resolve();
    } catch (err) {
      console.error(err);
      reject(err);
    }
  })
}
async function minifyJSON(filePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
      try {
          const jsonData = fs.readFileSync(filePath, 'utf8');
          const minifiedData = jsonminify(jsonData);

          fs.writeFileSync(filePath, minifiedData, 'utf8');

          resolve();
      } catch (err) {
          console.error(err);
          reject(err);
      }
  });
}
async function deleteFolder(folderPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
      rimrafSync(folderPath)
      resolve();
  });
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

export default uploadPackage;
