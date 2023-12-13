import express, { Request, Response } from "express";
import { query } from "../database";
import jwt from "jsonwebtoken";

const PER_PAGE = 10;
const RegEx_Exact = /^\d+\.\d+\.\d+$/;
const RegEx_Range = /^\d+\.\d+\.\d+-\d+\.\d+\.\d+$/;
const RegEx_Carat = /^\^\d+\.\d+\.\d+$/;
const RegEx_Tilde = /^~\d+\.\d+\.\d+$/;

interface IPackageInfo {
  Version: string;
  Name: string;
}

interface IPackagesRequest {
  headers: {
    "X-Authorization": string;
  };
  query: {
    offset: string;
  };
  body: IPackageInfo[];
}

function compareQueryStr(versionstr: string): string {
  if (RegEx_Exact.test(versionstr)) {
    return `package_version = '${versionstr}'`;
  } else if (RegEx_Range.test(versionstr)) {
    const [min, max] = versionstr.split("-");
    return `cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${min}')) > -1 AND cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${max}')) < 1`;
  } else if (RegEx_Carat.test(versionstr)) {
    const [_, major, minor, patch] = versionstr.split(/[\^.]/);
    return `cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${major}.${minor}.${patch}')) > -1 AND cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${
      Number(major) + 1
    }.0.0')) = -1`;
  } else if (RegEx_Tilde.test(versionstr)) {
    const [_, major, minor, patch] = versionstr.split(/[~.]/);
    return `cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${major}.${minor}.${patch}')) > -1 AND cmp_pkgver(text_to_pkgver(package_version), text_to_pkgver('${major}.${
      Number(minor) + 1
    }.0')) = -1`;
  }
  return "";
}

async function packages(req: Request<IPackagesRequest>, res: Response) {
  try {
    const xauth = req.headers["X-Authorization"];
    const { offset } = req.query;
    const packagerequests: IPackageInfo[] = req.body;
    console.log("OFFSET: ", offset);
    console.log("PACKAGES: ", packagerequests);
    //if not auth, auth missing, return 400
    //if too long, return 413
    if (packagerequests.some((pkg: IPackageInfo) => pkg.Name === "*")) {
      const result = await query(
        "SELECT package_id, package_version, package_name FROM packages LIMIT $1 OFFSET $2;",
        [PER_PAGE, Number(offset) * PER_PAGE]
      );
      res.status(200).json(result.rows);
      return;
    }
    const strlist = packagerequests.map((pkg: IPackageInfo) => {
      const cmpstr = compareQueryStr(pkg.Version);
      if (cmpstr === "") {
        res.sendStatus(400);
        return;
      }
      return `(package_name = '${pkg.Name}' AND ${cmpstr})`;
    });
    const querystr = `SELECT package_id, package_version, package_name FROM packages WHERE ${strlist.join(
      " OR "
    )};`;
    console.log("QUERYSTR: ", querystr);

    return res.sendStatus(200);
  } catch (err) {
    console.log(err);
    return res.sendStatus(500);
  }
}

export default packages;
