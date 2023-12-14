import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { query } from "../database";
import { verifyToken } from "../common";
const tokenKey: string = "461_secret_key";
const defaultUsername = JSON.stringify("ece30861defaultadminuser");
export async function ResetRegistry(req: Request, res: Response) {
  const token = req.headers['x-authorization'] as string;
  if (!token) return res.sendStatus(400);
  let decoded = null
  try {
      decoded = await verifyToken(token);
  } catch (err) {
      console.log(err)
      return res.sendStatus(401);
  }
  try {
    const username = (decoded as any)[1].username;
    if (username !== defaultUsername) {
      console.log("Incorrect username")
      return res.sendStatus(401);
    }
    await query("DELETE FROM packagehistory;")
    await query("DELETE FROM packages;");
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error resetting registry: ", error)
    return res.sendStatus(500)
  }
}
export default ResetRegistry;
