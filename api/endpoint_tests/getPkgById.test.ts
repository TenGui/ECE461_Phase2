// api/endpoint_tests/packageById.test.ts

jest.mock("../database");
import { query as originalQuery } from "../database";
import packageById from "../endpoints/getPkgById";
import { Request, Response } from "express";

const query = originalQuery as jest.Mock;

describe("packageById", () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Reset all mock calls before each test
    });
    it("should retrieve and send the package data", async () => {
    const req = { params: { id: "123" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

    // Mock the database response to simulate a package found with the provided ID
    query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
        package_name: "examplePackage",
        package_version: "1.0.0",
        package_id: "123",
        package_zip: Buffer.from("exampleZipContent"),
        jsprogram: "exampleJSProgram",
        }],
    });

    await packageById(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_id = $1", ["123"]);
    expect(query).toHaveBeenCalledWith('INSERT INTO packageHistory (package_name, user_name, user_action, package_id) VALUES($1, $2, $3, $4)', ["examplePackage", "ece30861defaultadminuser", "DOWNLOAD", "123"]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        metadata: { Name: "examplePackage", Version: "1.0.0", ID: "123" },
        data: { Content: "ZXhhbXBsZVppcENvbnRlbnQ=", JSProgram: "exampleJSProgram" },
    });
    });

    it("should send 404 if the package is not found", async () => {
    const req = { params: { id: "nonexistentPackage" } } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock the database response to simulate no rows found
    query.mockResolvedValueOnce({ rowCount: 0 });

    await packageById(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_id = $1", ["nonexistentPackage"]);
    expect(res.sendStatus).toHaveBeenCalledWith(404);
    });

    it("should handle database query errors", async () => {
    const req = { params: { id: "123" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;

    // Mock the database response to simulate an error
    query.mockRejectedValueOnce(new Error("Simulated database error"));

    await packageById(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_id = $1", ["123"]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Internal Server Error");
    });

    it("should send 400 if package ID is missing", async () => {
    const req = { params: {} } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    await packageById(req as Request, res);

    // Verify the expected interactions
    expect(query).not.toHaveBeenCalled(); // Ensure query was not called
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    });
});
