import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };

export function ArrowLeft(props: IconProps) {
  return <svg {...base} {...props}><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></svg>;
}

export function ArrowRight(props: IconProps) {
  return <svg {...base} {...props}><path d="m9 18 6-6-6-6" /><path d="M15 12H5" /></svg>;
}

export function BookOpen(props: IconProps) {
  return <svg {...base} {...props}><path d="M3.5 5.5c3.2-.8 5.9-.2 8.5 2v12c-2.6-2.2-5.3-2.8-8.5-2V5.5Z" /><path d="M20.5 5.5c-3.2-.8-5.9-.2-8.5 2v12c2.6-2.2 5.3-2.8 8.5-2V5.5Z" /></svg>;
}

export function Pencil(props: IconProps) {
  return <svg {...base} {...props}><path d="m4 20 4.4-1 10.1-10.1a2 2 0 0 0-2.8-2.8L5.6 16.2 4 20Z" /><path d="m13.8 8 2.8 2.8" /></svg>;
}

export function Clock(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
}

export function Pin(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></svg>;
}

export function User(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6" /></svg>;
}

export function Upload(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 14v5h14v-5" /></svg>;
}

export function History(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M12 7v5l3 2" /></svg>;
}

export function Close(props: IconProps) {
  return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

