import React from "react";
import { User } from "firebase/auth";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import UserProfile from "./UserProfile";

test("renders user initials when no photoURL is provided", () => {
  const mockUser = {
    displayName: "Test User",
    email: "test@example.com",
    photoURL: null,
  } as unknown as User;
  const mockOnLogout = vi.fn();

  render(<UserProfile user={mockUser} onLogout={mockOnLogout} />);

  // Should render initials 'TU' based on 'Test User'
  expect(screen.getByText("TU")).toBeInTheDocument();
});

test("calls onLogout when sign out button is clicked", () => {
  const mockUser = {
    displayName: "Test User",
    email: "test@example.com",
    photoURL: null,
  } as unknown as User;
  const mockOnLogout = vi.fn();

  render(<UserProfile user={mockUser} onLogout={mockOnLogout} />);

  // Open the dropdown
  const button = screen.getByRole("button", { name: /user profile menu/i });
  fireEvent.click(button);

  // Click the sign out button
  const signOutButton = screen.getByText("Sign Out");
  fireEvent.click(signOutButton);

  expect(mockOnLogout).toHaveBeenCalledTimes(1);
});
