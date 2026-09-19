import { AdminApp } from "./components/AdminApp";
import { Diary } from "./components/Diary";
import { BookOpen } from "./components/Icons";

export function App() {
  const path = window.location.pathname.split("/").filter(Boolean);
  if (path[0] === "c" && path[1]) return <Diary guestToken={path[1]} />;
  if (path[0] === "a" && path[1]) return <AdminApp adminToken={path[1]} />;
  return <MissingLink />;
}

function MissingLink() {
  return (
    <main className="missing-page">
      <div className="missing-paper">
        <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
        <p className="eyebrow">Щоденник</p>
        <h1>У посиланні бракує сторінки</h1>
        <p>Попросіть у старости або адміністратора повне секретне посилання на розклад.</p>
      </div>
    </main>
  );
}
