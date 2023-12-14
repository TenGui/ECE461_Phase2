import express, { Request, Response } from "express";
import { query } from "../database";
import { verifyToken} from "../common";
import { exec } from 'child_process';
import path from 'path';
import fs from "fs";
import { json } from "body-parser";
const defaultUsername = 'ece30861defaultadminuser';

async function ratePkgById(req: Request, res: Response) {
    const token = req.headers['x-authorization'] as string;
    // if (!token) return res.sendStatus(400)
    const id = req.params.id;
    if (!id) return res.sendStatus(400);
    let decoded = null
    try {
        decoded = await verifyToken(token);
    } catch (err) {
        return res.sendStatus(400);
    }
    const pkg = await query("SELECT * FROM packages WHERE package_id = $1;", [id]);
    if (pkg.rowCount == 0 ) return res.sendStatus(404);
    let pkg_url = pkg.rows[0].package_url;
    if (pkg_url.includes('@')) pkg_url = removeUsernameAndProtocol(pkg_url);
    if (!pkg_url.startsWith('https'))  pkg_url = 'https:' + pkg_url.split(':')[1];
    fs.writeFileSync(`${__dirname}/../one-url.txt`, pkg_url);
    let result = null;
    try {
        result = await runTsc();
        console.log(result);
        const { URL, ...trimmedResult } = JSON.parse(result.trim());
        //get rid of the URL in the result
        const username = defaultUsername;      
        const hisInsert = await query('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', [pkg.rows[0].package_name, username, 'RATE', id]);
        const json_response = JSON.stringify(trimmedResult);
        return res.status(200).send(json_response);
    } catch (error) {
        console.error("Error rating package by ID: ", error)
        return res.sendStatus(500)
    }
}
  
function removeUsernameAndProtocol(url: string): string {
  const githubIndex = url.indexOf("github.com");

  if (githubIndex !== -1) {
      return "https://" + url.substring(githubIndex);
  }

  return url;
}

async function runTsc(): Promise<string> {
    return new Promise((resolve, reject) => {
      const rootPath = path.join(__dirname, '..', '..');
      const command = 'node ./dist/src/main.js ./api/one-url.txt';
  
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

export default ratePkgById;