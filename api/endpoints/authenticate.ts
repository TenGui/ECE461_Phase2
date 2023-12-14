import { Request, Response } from "express";
import { query } from "../database";
import jwt from "jsonwebtoken";
const tokenKey: string = "461_secret_key";
const defaultUsername = JSON.stringify("ece30861defaultadminuser");
const defaultPassword = JSON.stringify("correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE packages;");
async function authenticate(req: Request, res: Response) {
  const request = req.body;
  if (request.User === undefined || request.Secret === undefined) {
    return res.sendStatus(400);
  }
  if (request.User.name === undefined || request.User.isAdmin === undefined || request.Secret.password === undefined) {
    return res.sendStatus(400);
  }
  if (!request.User.isAdmin) return res.sendStatus(401);
  const password = JSON.stringify(request.Secret.password);
  if (password !== defaultPassword) {
    console.log("Incorrect password")
    console.log("password: ", password)
    console.log("defaultPassword: ", defaultPassword)
    return res.sendStatus(400);
  }
  const username = JSON.stringify(request.User.name);
  if (username !== defaultUsername) {
    console.log("Incorrect username")
    console.log("username: ", username)
    console.log("defaultUsername: ", defaultUsername)
    return res.sendStatus(400);
  }
  const user_credential = {username: username, password: password};
  const token = jwt.sign(user_credential, tokenKey, { expiresIn: '10h' });
  await query("UPDATE users SET token = $1 WHERE user_name = $2", [token, defaultUsername]);
  const json_token = JSON.stringify(token)
  return res.status(200).send(json_token);
}
export default authenticate;