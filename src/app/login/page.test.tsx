import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createClientComponentClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("toggles between sign in and sign up views", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      screen.getByRole("heading", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });
});
