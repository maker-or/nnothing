import AiHome from '../../components/AiHome';
import Link from 'next/link';

const Page = () => {
  return (
    <main>
      <div className="fixed top-4 right-4 z-50">
        <Link
          href="/debug-posthog"
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-md shadow-lg transition-colors"
        >
          Debug PostHog
        </Link>
      </div>
      <AiHome />
    </main>
  );
};

export default Page;
