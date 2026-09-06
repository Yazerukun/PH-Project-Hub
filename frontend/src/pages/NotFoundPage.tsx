import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="text-6xl font-black text-gray-700">404</div>
      <h1 className="text-xl font-bold text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-gray-500">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex h-10 items-center rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-500"
      >
        Back to home
      </Link>
    </div>
  );
}