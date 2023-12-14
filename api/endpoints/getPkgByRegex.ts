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
    const payload: any = []
    let result = null;
    try {
        result = await query('SELECT package_name, package_version FROM packages WHERE package_name ~ $1 OR package_readme ~ $2', [regex, regex]);
    } catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
    if (result.rowCount === 0) {
        return res.sendStatus(404);
    }
    console.log(result.rows);
    return res.status(200).json(result.rows);
}
  
export default getPackageByRegEx;
  
