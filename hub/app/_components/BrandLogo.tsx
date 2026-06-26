import Image from "next/image";

export function BrandLogo({
  className = "h-8 w-[139px]",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`block shrink-0 ${className}`}>
      <Image
        src="/gt-school-logo.svg"
        alt=""
        width={139}
        height={32}
        priority={priority}
        unoptimized
        className="gt-brand-logo-light block h-full w-full object-contain"
      />
      <Image
        src="/gt-school-logo-inverted.svg"
        alt=""
        width={139}
        height={32}
        priority={priority}
        unoptimized
        className="gt-brand-logo-dark h-full w-full object-contain"
      />
    </span>
  );
}
