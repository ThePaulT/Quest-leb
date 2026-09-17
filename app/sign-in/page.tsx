import { SignInForm } from '@/components/SignInForm';
import { localeFrom } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; next?: string }>;
}) {
  const { lang, next } = await searchParams;
  return <SignInForm locale={localeFrom(lang)} next={next ?? '/'} />;
}
