// api/endpoint_tests/getPkgByName.test.ts
jest.mock("../database");
import { query as originalQuery } from "../database";
import getPkgByName from "../endpoints/getPkgByName";
import { Request, Response } from "express";

const query = originalQuery as jest.Mock;
describe("getPkgByName", () => {
    it("should retrieve and send the package history", async () => {
    const req = { headers: { 'x-authorization': 'exampleToken' }, params: { name: "examplePackage" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

    // Mock the database responses to simulate a package found with the provided name and associated history
    query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
        package_name: "examplePackage",
        package_version: "1.0.0",
        package_id: "123",
        }],
    });
    query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
        package_id: "123",
        user_name: "exampleUser",
        user_action: "DOWNLOAD",
        action_time: "exampleTimestamp",
        }],
    });
    query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
        is_admin: true,
        }],
    });
    query.mockRejectedValueOnce(new Error("Simulated user database error"));
    await getPkgByName(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1", ["examplePackage"]);
    expect(query).toHaveBeenCalledWith("SELECT * FROM packagehistory WHERE package_name = $1", ["examplePackage"]);
    expect(query).toHaveBeenCalledWith("SELECT is_admin FROM users WHERE user_name = $1", ["exampleUser"]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{
        User: { name: "exampleUser", isAdmin: true },
        Date: "exampleTimestamp",
        Packagemetadata: { Name: "examplePackage", Version: "1.0.0", ID: "123" },
        Action: "DOWNLOAD",
    }]);
    });

    it("should send 404 if no packages found with the provided name", async () => {
    const req = { headers: { 'x-authorization': 'exampleToken' }, params: { name: "nonexistentPackage" } } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock the database responses to simulate no rows found
    query.mockResolvedValueOnce({ rowCount: 0 });

    await getPkgByName(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1", ["nonexistentPackage"]);
    expect(res.sendStatus).toHaveBeenCalledWith(404);
    });

    it("should handle database query errors for package retrieval", async () => {
    const req = { headers: { 'x-authorization': 'exampleToken' }, params: { name: "examplePackage" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;

    // Mock the database response to simulate an error
    query.mockRejectedValueOnce(new Error("Simulated database error"));

    await getPkgByName(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1", ["examplePackage"]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.sendStatus).not.toHaveBeenCalledWith(404);
    });

    it("should handle database query errors for package history retrieval", async () => {
    const req = { headers: { 'x-authorization': 'exampleToken' }, params: { name: "examplePackage" } } as Partial<Request>;
    const res = { status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;

    // Mock the database responses to simulate a package found with the provided name and an error during history retrieval
    query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
        package_name: "examplePackage",
        package_version: "1.0.0",
        package_id: "123",
        }],
    });
    query.mockRejectedValueOnce(new Error("Simulated database error"));

    await getPkgByName(req as Request, res);

    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1", ["examplePackage"]);
    expect(query).toHaveBeenCalledWith("SELECT * FROM packagehistory WHERE package_name = $1", ["examplePackage"]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.sendStatus).not.toHaveBeenCalledWith(404);
    });

    it("should send 400 if name is missing", async () => {
    const req = { headers: { 'x-authorization': 'exampleToken' }, params: {} } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    await getPkgByName(req as Request, res);

    // Verify the expected interactions
    expect(query).not.toHaveBeenCalled(); // Ensure query was not called
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    });
});
