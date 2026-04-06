import Image from "next/image";
import Link from "next/link";

/**
 * Logo + name linking to the public landing page (for auth layouts).
 */
export function AuthBrandHomeLink() {
  return (
    <Link
      href="/"
      className="absolute left-6 top-6 z-10 flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-foreground/80 md:left-10 md:top-10"
      aria-label="AcornArranger home"
    >
      <Image
        src="/icon.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9"
        priority
      />
      <span>AcornArranger</span>
    </Link>
  );
}
