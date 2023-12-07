// api/endpoint_tests/getPackageByRegEx.test.ts
jest.mock("../database");
import { query as originalQuery } from "../database";
import getPackageByRegEx from "../endpoints/getPkgByRegex";
import { Request, Response } from "express";
const query = originalQuery as jest.Mock;

describe("getPackageByRegEx", () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Reset all mock calls before each test
    });
  it("should return packages based on a safe regex", async () => {
    const req = { body: { RegEx: "safeRegex" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

    // Mock the safe-regex module to always return true for simplicity
    jest.mock('safe-regex', () => () => true);

    // Mock the database response to simulate finding packages
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        package_name: "examplePackage",
        package_version: "1.0.0",
      }],
    });

    await getPackageByRegEx(req as Request, res);

    // Verify the expected interactions
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{
      Version: "1.0.0",
      Name: "examplePackage",
    }]);
    jest.unmock('safe-regex');
  });

  it("should return 400 for an unsafe regex", async () => {
    const req = { body: { RegEx: ".*" } } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock the safe-regex module to always return false for simplicity
    jest.mock('safe-regex', () => () => false);

    await getPackageByRegEx(req as Request, res);

    // Verify the expected interactions
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    jest.unmock('safe-regex');
  });

  it("should return 404 if no packages are found", async () => {
    const req = { body: { RegEx: "safeRegex" } } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock the safe-regex module to always return true for simplicity
    jest.mock('safe-regex', () => () => true);

    // Mock the database response to simulate no rows found
    query.mockResolvedValueOnce({ rowCount: 0 });

    await getPackageByRegEx(req as Request, res);

    // Verify the expected interactions
    expect(res.sendStatus).toHaveBeenCalledWith(404);
    jest.unmock('safe-regex');
  });

});

