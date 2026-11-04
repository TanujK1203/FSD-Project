/** Re-mounts on every navigation, which replays the page entrance in motion.css. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
