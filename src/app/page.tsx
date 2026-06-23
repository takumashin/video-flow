import { redirect } from 'next/navigation'
import StudioPage from '@/components/studio-page'
import { auth } from '@/lib/auth/config'
import { getAccountBindingStatus } from '@/lib/auth/account-binding'

export default async function Home() {
  const session = await auth()

  if (session?.user?.id) {
    const binding = await getAccountBindingStatus(session.user.id)
    if (binding.needsBinding)
      redirect('/account/bind')
  }

  return <StudioPage />
}
