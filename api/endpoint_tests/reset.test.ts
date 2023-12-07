// Import necessary modules and types for testing
import { Request, Response } from "express";
import { query } from "../database";
import ResetRegistry from "../endpoints/resetregistry";
const defaultUsername = "ece30861defaultadminuser";
// Mock the database query function
jest.mock("../database");
const mockedQuery = query as jest.Mock;

describe("ResetRegistry", () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  it("should reset the registry and return 200 status", async () => {
    const req = {} as Request;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock successful execution of queries
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 }); // Mock DELETE FROM users
    mockedQuery.mockResolvedValueOnce({ rowCount: 2 }); // Mock DELETE FROM packagehistory
    mockedQuery.mockResolvedValueOnce({ rowCount: 3 }); // Mock DELETE FROM packages

    await ResetRegistry(req, res);

    // Verify the expected interactions
    expect(mockedQuery).toHaveBeenCalledWith("DELETE FROM users WHERE user_name != $1;", [defaultUsername]);
    expect(mockedQuery).toHaveBeenCalledWith("DELETE FROM packagehistory;");
    expect(mockedQuery).toHaveBeenCalledWith("DELETE FROM packages;");
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("should handle errors and return 400 status", async () => {
    const req = {} as Request;
    const res = { sendStatus: jest.fn() } as unknown as Response;

    // Mock an error during execution of queries
    mockedQuery.mockRejectedValueOnce(new Error("Simulated database error"));

    await ResetRegistry(req, res);

    // Verify the expected interactions
    expect(mockedQuery).toHaveBeenCalledWith("DELETE FROM users WHERE user_name != $1;", [defaultUsername]);
    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });
});
