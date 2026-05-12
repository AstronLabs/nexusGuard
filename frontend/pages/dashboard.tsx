import { CalendarDays, Info, Scale, Shield } from "lucide-react";
import { AppShell } from "@/components/Layout";
import { Bars, Card, IconBadge, PageTitle, StatusPill } from "@/components/ui";

const activity = [
  ["Premium paid successfully", "-$12.50 USDC", "2h ago", "bg-secondary"],
  ["Pool rewards earned", "+$4.20 USDC", "1d ago", "bg-on-tertiary-container"],
  ["Governance vote cast", "NGP-23 Proposal", "3d ago", "bg-primary"]
];

export default function Dashboard() {
  return (
    <AppShell>
      <PageTitle eyebrow="Institutional Overview" title="System Dashboard">
        <div className="flex items-center gap-2 text-body-sm font-medium text-on-surface-variant">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
          </span>
          Real-time Coverage Active
        </div>
      </PageTitle>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
        <Card className="md:col-span-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-2 text-label-caps uppercase text-on-surface-variant">Total Insurance Balance</p>
              <h2 className="font-display text-display">$5,240.00 <span className="text-headline-md text-on-surface-variant">USDC</span></h2>
            </div>
            <IconBadge icon={Shield} tone="neutral" />
          </div>
          <div className="mt-6 flex flex-wrap gap-stack-lg border-t border-outline-variant pt-6">
            <div className="flex items-center gap-3">
              <IconBadge icon={CalendarDays} tone="secondary" />
              <div>
                <p className="text-label-caps text-on-surface-variant">Weekly Premium</p>
                <p className="font-mono text-mono-data font-semibold">$12.50 USDC</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <IconBadge icon={Scale} tone="neutral" />
              <div>
                <p className="text-label-caps text-on-surface-variant">Claims Status</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-mono-data font-semibold">0 Active</p>
                  <StatusPill>STABLE</StatusPill>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-4">
          <div className="mb-stack-md flex items-center justify-between">
            <p className="text-label-caps uppercase text-on-surface-variant">Governance Participation</p>
            <Info size={18} className="text-on-surface-variant" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-heading text-headline-lg">3</span>
            <span className="text-body-sm text-on-surface-variant">Active Proposals</span>
          </div>
          <div className="my-6 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
            <div className="h-full w-[65%] bg-primary" />
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 text-body-sm font-medium">
            NGP-24: Liquidity Cap <span className="float-right rounded bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-secondary-container">VOTE</span>
          </div>
        </Card>

        <Card className="md:col-span-8">
          <div className="mb-stack-lg flex items-center justify-between">
            <h3 className="font-heading text-headline-md">Pool Contribution History</h3>
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-caps text-primary">6 Months</span>
          </div>
          <Bars values={[40, 55, 45, 75, 65, 90]} labels={["JAN", "FEB", "MAR", "APR", "MAY", "JUN"]} activeIndex={5} />
        </Card>

        <Card className="md:col-span-4">
          <h3 className="mb-stack-md font-heading text-headline-md">Recent Activity</h3>
          <div className="space-y-6">
            {activity.map(([title, amount, time, dot]) => (
              <div key={title} className="flex gap-4">
                <span className={`mt-2 h-2 w-2 rounded-full ${dot}`} />
                <div>
                  <p className="text-body-sm font-medium">{title}</p>
                  <p className="mt-1 font-mono text-[11px] text-on-surface-variant">{amount} • {time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
