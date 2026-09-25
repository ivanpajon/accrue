import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
import Calculator from '@/components/calculator';
import { SignIn } from '@/components/account-controls';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const user=await getChatGPTUser();
  const signInPath=chatGPTSignInPath('/');
  if(!user)return <SignIn signInPath={signInPath} />;
  return <Calculator displayName={user.displayName} signInPath={signInPath} signOutPath={chatGPTSignOutPath('/')} />;
}
