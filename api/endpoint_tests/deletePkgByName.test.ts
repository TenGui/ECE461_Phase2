// api/endpoint_tests/deletePkgByName.test.ts
jest.mock("../database");
import { query as originalQuery } from "../database";
import deletePkgByName from "../endpoints/deletePkgByName";
import { Request, Response } from "express";

const query = originalQuery as jest.Mock;

describe("deletePkgByName", () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Reset all mock calls before each test
    });
    it("should send 200 after successful deletion", async () => {
        const req = { params: { name: "examplePackage" } } as Partial<Request>;
        const res = { sendStatus: jest.fn() } as unknown as Response;

        // Mock the database response to simulate successful deletion
        query.mockResolvedValueOnce({ rowCount: 1 }); // Assuming one row is affected for both queries

        await deletePkgByName(req as Request, res);

        // Verify the expected interactions
        expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1;", ["examplePackage"]);
        expect(query).toHaveBeenCalledWith("DELETE FROM packagehistory WHERE package_name = $1;", ["examplePackage"]);
        expect(query).toHaveBeenCalledWith("DELETE FROM packages WHERE package_name = $1;", ["examplePackage"]);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it("should send 404 if the package is not found", async () => {
        const req = { params: { name: "nonexistentPackage" } } as Partial<Request>;
        const res = { sendStatus: jest.fn() } as unknown as Response;

        // Mock the database response to simulate no rows found
        query.mockResolvedValueOnce({ rowCount: 0 });

        await deletePkgByName(req as Request, res);

        // Verify the expected interactions
        expect(query).toHaveBeenCalledWith("SELECT * FROM packages WHERE package_name = $1;", ["nonexistentPackage"]);
        expect(res.sendStatus).toHaveBeenCalledWith(404);
    });

    it("should send 400 if name is missing", async () => {
        const req = { params: {} } as Partial<Request>;
        const res = { sendStatus: jest.fn() } as unknown as Response;

        await deletePkgByName(req as Request, res);

        // Verify the expected interactions
        expect(query).not.toHaveBeenCalled(); // Ensure query was not called
        expect(res.sendStatus).toHaveBeenCalledWith(400);
    });
});
