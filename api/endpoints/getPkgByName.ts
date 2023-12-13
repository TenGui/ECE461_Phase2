import express, { Request, Response } from "express";
import { query } from "../database";
import { verifyToken } from "../common";
const defaultUsername = 'ece30861defaultadminuser';

async function getPkgByName(req: Request, res: Response) {
    const token = req.headers['x-authorization'] as string;
    const name = req.params.name as string;
    if (name.trim() == '' || !name) {
      console.error("Error fetching packages by name: name is empty");
      return res.sendStatus(400)
    }
    let encoded = null;
    try {
        encoded = await verifyToken(token);
    } catch (error) {
      console.error("Error verifying token: ", error);
      return res.sendStatus(400);
    }
    try {
      const result = await query("SELECT * FROM packages WHERE package_name = $1", [name]);
      if (result.rowCount === 0) {
        return res.sendStatus(404);
      }
    } catch (error) {
      console.error("Error fetching packages by name (1st query): ", error);
      return res.sendStatus(500);
    }
  
    try {
      const history = await query("SELECT * FROM packagehistory WHERE package_name = $1", [name]);
      const response: any = [];
      const promises: Promise<void>[] = [];
  
      history.rows.forEach((row) => {
        const pkg_id = row.package_id;
        const username = row.user_name;
        const action = row.user_action;
  
        const pkgPromise = query("SELECT * FROM packages WHERE package_id = $1", [pkg_id]);
        const isAdminPromise = query("SELECT is_admin FROM users WHERE user_name = $1", [username]);
  
        promises.push(
          Promise.all([pkgPromise, isAdminPromise]).then(([pkgResult, isAdminResult]) => {
            const User = { name: username, isAdmin: isAdminResult.rows[0].is_admin };
            const Date = row.action_time;
            const Packagemetadata = {
              Name: row.package_name,
              Version: pkgResult.rows[0].package_version,
              ID: pkg_id,
            };
            const responseObj = { User, Date, Packagemetadata, Action: action };
            response.push(responseObj);
          })
        );
      });
  
      await Promise.all(promises);
      return res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching packages history by name (2nd query): ", error);
      return res.sendStatus(500);
    }
}

export default getPkgByName;