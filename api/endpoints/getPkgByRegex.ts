import express, { Request, Response } from "express";
import { query } from "../database";
import jwt from "jsonwebtoken";
import { verifyToken} from "../common";
const safe = require('safe-regex');
async function getPackageByRegEx(req: Request, res: Response) {
    // const token = req.headers['x-authorization'] as string;
    // let decoded = null
    // try {
    //     decoded = await verifyToken(token);
    //     if (!decoded) {
    //         return res.sendStatus(400);
    //     }
    // } catch (err) {
    //     console.log(err);
    //     return res.sendStatus(400)
    // }
    const regex = req.body.RegEx;
    const isSafe = safe(regex);
    if(!isSafe) {
        console.log("Regex is not safe");
        return res.sendStatus(400);
    }
    const payload: any = []
    const result = await query('SELECT package_name, package_version FROM packages WHERE package_name ~ $1 OR package_readme ~ $2', [regex, regex]);
    if (!result || result.rowCount === 0) {
        return res.sendStatus(404);
    }
    result.rows.forEach((row) => {
        payload.push({
            Version: row.package_version,
            Name: row.package_name
        })
    })
    res.status(200).json(payload);
}
  
export default getPackageByRegEx;
  
