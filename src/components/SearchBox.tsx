import { SearchIcon } from "./icons";

export function SearchBox({
  defaultValue = "",
  autoFocus = false,
  className,
  id = "q",
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <form action="/search" role="search" className={`searchbox ${className ?? ""}`}>
      <SearchIcon size={18} />
      <label className="visually-hidden" htmlFor={id}>
        Search products and stores
      </label>
      <input
        id={id}
        name="q"
        type="search"
        className="input"
        placeholder="Search kurtas, earrings, candles…"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
      />
    </form>
  );
}
