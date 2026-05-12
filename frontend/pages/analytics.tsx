import { Landmark, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/Layout";
import { Bars, Card, PageTitle, ProgressBar, StatusPill } from "@/components/ui";

const risk = [
  ["Smart Contract", 40, "bg-primary"],
  ["Stablecoin Depeg", 30, "bg-secondary"],
  ["Oracle Failure", 15, "bg-on-tertiary-container"],
  ["Exchange Default", 10, "bg-outline"],
  ["Other Governance", 5, "bg-surface-variant"]
];

const metrics = [
  ["Monthly Payouts", "$1.2M", "Approved this cycle"],
  ["Active Members", "14.2k", "Unique wallet holders"],
  ["Approval Rate", "92.4%", "Governance verified"],
  ["Risk Index", "Low", "Safety factor 4.2x"]
];

const payouts = [
  ["Curve Finance Breach", "Smart Contract", "450,000 USDC", "0x82...1a3f", "Oct 12, 2024", "Completed"],
  ["Euler Protocol Incident", "Lending Pool", "310,000 DAI", "0x44...9d2e", "Sep 28, 2024", "Completed"],
  ["UST Depeg Legacy", "Stablecoin", "125,500 USDC", "0x12...ff55", "Sep 15, 2024", "Auditing"]
];

export default function Analytics() {
  return (
    <AppShell>
      <PageTitle eyebrow="Ecosystem Health" title="Pool Analytics">
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-white p-1">
          {["1M", "3M", "1Y", "All"].map((period, index) => (
            <button key={period} className={index === 0 ? "rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-on-primary" : "rounded-md px-4 py-2 text-body-sm text-on-surface-variant hover:bg-surface-container-low"}>
              {period}
            </button>
          ))}
        </div>
      </PageTitle>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
        <Card className="md:col-span-8">
          <div className="mb-stack-md flex flex-wrap items-start justify-between gap-stack-md">
            <div>
              <h2 className="font-heading text-headline-md">Treasury Balance</h2>
              <p className="text-body-sm text-on-surface-variant">Growth of cumulative protocol reserves</p>
            </div>
            <div className="text-left md:text-right">
              <p className="font-heading text-headline-md font-bold">$142,850,200</p>
              <span className="font-mono text-mono-data text-secondary">+12.4% vs prev. month</span>
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low/30 px-4 py-8">
            <Bars values={[40, 45, 42, 55, 65, 60, 80, 85]} />
          </div>
        </Card>

        <Card className="md:col-span-4">
          <h2 className="mb-stack-md font-heading text-headline-md">Risk Allocation</h2>
          <div className="space-y-stack-md">
            {risk.map(([label, value, color]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="font-semibold">{value}%</span>
                </div>
                <ProgressBar value={value as number} color={color as string} />
              </div>
            ))}
          </div>
        </Card>

        {metrics.map(([label, value, helper], index) => (
          <Card key={label} className="md:col-span-3">
            <span className="text-label-caps uppercase text-on-surface-variant">{label}</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-heading text-headline-lg">{value}</span>
              {index === 0 && <TrendingUp size={18} className="text-secondary" />}
              {index === 2 && <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />}
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">{helper}</p>
          </Card>
        ))}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-white md:col-span-12">
          <div className="border-b border-outline-variant bg-surface-container-low/50 px-6 py-4">
            <h2 className="font-heading text-headline-md">Recent Major Payouts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low/30 text-label-caps text-on-surface-variant">
                  <th className="px-6 py-4">Asset / Category</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {payouts.map(([asset, category, amount, recipient, date, status]) => (
                  <tr key={asset}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-stack-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high">
                          <Landmark size={18} />
                        </div>
                        <div>
                          <p className="text-body-sm font-semibold">{asset}</p>
                          <p className="text-body-sm text-on-surface-variant">{category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-mono-data font-bold">{amount}</td>
                    <td className="px-6 py-4 font-mono text-mono-data text-on-surface-variant">{recipient}</td>
                    <td className="px-6 py-4 text-body-sm">{date}</td>
                    <td className="px-6 py-4">
                      <StatusPill tone={status === "Completed" ? "success" : "neutral"}>{status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
