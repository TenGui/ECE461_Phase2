// api/endpoint_tests/deletePkgById.test.ts
jest.mock("../database");
import { query as originalQuery } from "../database";
import deletePkgById from "../endpoints/deletePkgById";
import { Request, Response } from "express";

const query = originalQuery as jest.Mock;

describe("deletePkgById", () => {
    it("should send 400 if id is missing", async () => {
        const req = { params: {} } as Partial<Request>;
        const res = { sendStatus: jest.fn() } as unknown as Response;

        await deletePkgById(req as Request, res);

        // Verify the expected interactions
        expect(query).not.toHaveBeenCalled(); // Ensure query was not called
        expect(res.sendStatus).toHaveBeenCalledWith(400);
        });
    it("should send 404 if the package is not found", async () => {
    const req = { params: { id: "123" } } as Partial<Request>;
    const res = { sendStatus: jest.fn() } as unknown as Response;
    // Mock the database response to simulate no rows found
    query.mockResolvedValueOnce({ rowCount: 0 });
    await deletePkgById(req as Request, res);
    // Verify the expected interactions
    expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_id = $1;", ["123"]);
    expect(res.sendStatus).toHaveBeenCalledWith(404);
    });
    it("should send 200 after successful deletion", async () => {
        const req = { params: { id: "123" } } as Partial<Request>;
        const res = { sendStatus: jest.fn() } as unknown as Response;
    
        // Mock the database response to simulate successful deletion
        query.mockResolvedValueOnce({ rowCount: 1 }); // Assuming one row is affected for both queries
    
        await deletePkgById(req as Request, res);
    
        // Verify the expected interactions
        expect(query).toHaveBeenCalledWith("DELETE FROM packagehistory WHERE package_id = $1;", ["123"]);
        expect(query).toHaveBeenCalledWith("DELETE FROM packages WHERE package_id = $1;", ["123"]);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
      });
});
