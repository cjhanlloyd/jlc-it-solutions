// The studio's section switcher. Panels stay mounted (toggled with `hidden`) so nothing typed is lost.
export type StudioTab = 'details' | 'design' | 'photos';
const TABS: [StudioTab, string][] = [['details', 'Details'], ['design', 'Design'], ['photos', 'Photos & cover']];

export default function StudioTabs({ tab, setTab }: { tab: StudioTab; setTab: (t: StudioTab) => void }) {
  return (
    <div role="group" aria-label="Studio sections" className="flex gap-1 rounded-full bg-slate-100 p-1">
      {TABS.map(([t, label]) => (
        <button key={t} type="button" aria-pressed={tab === t} aria-controls={`studio-${t}`} onClick={() => setTab(t)}
          className={`flex-1 min-w-0 px-2 py-2 rounded-full text-xs font-bold font-display cursor-pointer ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
