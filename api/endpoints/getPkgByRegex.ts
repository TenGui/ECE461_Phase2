import express, { Request, Response } from "express";
import { query } from "../database";
import jwt from "jsonwebtoken";
import { verifyToken} from "../common";
const safe = require('safe-regex');
async function getPackageByRegEx(req: Request, res: Response) {
    const token = req.headers['x-authorization'] as string;
    let decoded = null
    try {
        decoded = await verifyToken(token);
        if (!decoded) {
            return res.sendStatus(400);
        }
    } catch (err) {
        console.log(err);
        return res.sendStatus(400)
    }
    const regex = req.body.RegEx;
    const isSafe = safe(regex);
    if(!isSafe) {
        console.log("Regex is not safe");
        return res.sendStatus(404);
    }
    let payload: any = []
    let result = null;
    try {
        result = await query('SELECT package_name, package_version FROM packages WHERE package_name ~ $1 COLLATE "C" OR package_readme ~ $2 COLLATE "C"', [regex, regex]);
    } catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
    if (result.rowCount === 0) {
        return res.sendStatus(404);
    }
    result.rows.forEach((row: any) => {
        payload.push({
            "Name": row.package_name,
            "Version": row.package_version,
            "ID": row.package_id
        })
    })
    console.log("payload: ", payload);
    return res.status(200).send(payload);
}
  
export default getPackageByRegEx;
  
