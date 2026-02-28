import { auth } from 'thepopebot/auth';
import { DashboardPage } from 'thepopebot/chat';

export default async function DashboardRoute() {
  const session = await auth();
  return <DashboardPage session={session} />;
}
