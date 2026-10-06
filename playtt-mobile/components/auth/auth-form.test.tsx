import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthForm } from '@/components/auth/auth-form';
import { authClient, refreshSession } from '@/lib/auth-client';
import { waitForStoredAuth } from '@/lib/auth-helpers';
import { routeAfterAuth } from '@/lib/user-api';
import * as Linking from 'expo-linking';
import { toast } from '@/lib/toast';

jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'storeClient' } }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'exp://192.168.1.10:8081/--/') }));

jest.mock('@/components/auth/social-auth-button', () => ({
  SocialAuthButton: ({ provider, onPress }: { provider: string; onPress: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load inside the hoisted Jest mock.
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>{provider}</Text></Pressable>;
  },
}));
jest.mock('@/components/ui/button', () => ({ Button: () => null }));
jest.mock('@/components/ui/form-divider', () => ({ FormDivider: () => null }));
jest.mock('@/components/ui/form-field', () => ({ FormField: () => null }));
jest.mock('@/components/ui/input', () => ({ Input: () => null }));
jest.mock('@/hooks/use-auth-theme', () => ({ useAuthTheme: () => ({}) }));
jest.mock('@/lib/apple-sign-in', () => ({ isAppleSignInAvailable: async () => false }));
jest.mock('@/lib/auth-api', () => ({}));
jest.mock('@/lib/auth-debug', () => ({ authDebug: jest.fn(), authDebugError: jest.fn() }));
jest.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { social: jest.fn() } }, refreshSession: jest.fn(),
}));
jest.mock('@/lib/auth-helpers', () => ({ waitForStoredAuth: jest.fn() }));
jest.mock('@/lib/auth-navigation', () => ({}));
jest.mock('@/lib/user-api', () => ({ routeAfterAuth: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toast: { error: jest.fn(), apiError: jest.fn() } }));

describe('Google sign in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(waitForStoredAuth).mockResolvedValue({ token: 'new-token', source: 'cookie' });
  });

  it('waits for the browser flow before refreshing and routing', async () => {
    let finishBrowser!: (result: unknown) => void;
    jest.mocked(authClient.signIn.social).mockImplementation(
      () => new Promise((resolve) => { finishBrowser = resolve; }) as never,
    );
    jest.mocked(refreshSession).mockResolvedValue({ data: { session: {} }, error: null } as never);
    const screen = render(<AuthForm />);
    fireEvent.press(screen.getByText('google'));
    expect(refreshSession).not.toHaveBeenCalled();
    expect(routeAfterAuth).not.toHaveBeenCalled();
    await act(async () => { finishBrowser({ error: null }); });
    await waitFor(() => expect(routeAfterAuth).toHaveBeenCalledTimes(1));
  });

  it('does not reuse stored Apple auth after the Google browser is canceled', async () => {
    jest.mocked(authClient.signIn.social).mockResolvedValue({ error: null } as never);
    jest.mocked(refreshSession).mockResolvedValue({ data: null, error: null } as never);
    const screen = render(<AuthForm />);
    fireEvent.press(screen.getByText('google'));
    await waitFor(() => expect(refreshSession).toHaveBeenCalled());
    expect(waitForStoredAuth).not.toHaveBeenCalled();
    expect(routeAfterAuth).not.toHaveBeenCalled();
  });

  it('sends the runtime callback and explains a rejected callback without attempting session completion', async () => {
    jest.mocked(authClient.signIn.social).mockResolvedValue({
      error: { code: 'INVALID_CALLBACK_URL', message: 'Invalid callback URL' },
    } as never);
    const screen = render(<AuthForm />);
    fireEvent.press(screen.getByText('google'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Google sign in could not return to this app. Please try another sign-in method.',
    ));
    expect(Linking.createURL).toHaveBeenCalledWith('/', { scheme: 'playtt' });
    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: 'google', callbackURL: 'exp://192.168.1.10:8081/--/',
    });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
