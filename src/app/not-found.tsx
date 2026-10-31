import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty">
        <h1>This page is not here</h1>
        <p>It may have been removed, or the link has a typo.</p>
        <Link href="/" className="btn btn--secondary">
          Go to the shop
        </Link>
      </div>
    </div>
  );
}
