import { CheckCircle2, Clock, History, Zap } from "lucide-react";
import { AppShell } from "@/components/Layout";
import { Card, PageTitle, ProgressBar } from "@/components/ui";

const proposals = [
  {
    id: "#NXP-042 • Parameter Adjustment",
    title: "Increase Coverage Reserve for L2 Protocols by 15%",
    body: "Rebalance treasury allocation to accommodate surging demand for micro-insurance in Layer 2 ecosystems.",
    quorum: "Quorum: 65% Reached",
    approve: 82.4,
    reject: 17.6
  },
  {
    id: "#NXP-041 • Operational",
    title: "Upgrade Oracle Integration to Chainlink CCIP",
    body: "Migrate oracle infrastructure to support cross-chain interoperability and real-time claim verification.",
    quorum: "Quorum: 22% / 40% Required",
    approve: 45,
    reject: 55
  }
];

export default function Governance() {
  return (
    <AppShell>
      <PageTitle eyebrow="Protocol Stewardship" title="Governance Dashboard">
        <Card className="flex items-center gap-4 px-4 py-3">
          <div className="rounded-full bg-secondary-container/30 p-2 text-secondary"><Zap size={20} /></div>
          <div>
            <p className="text-label-caps text-on-surface-variant">Voting Power</p>
            <p className="font-mono text-lg font-bold">2.4%</p>
          </div>
        </Card>
      </PageTitle>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="flex flex-col gap-gutter lg:col-span-4">
          <Card>
            <div className="mb-stack-md flex items-center justify-between">
              <h2 className="font-heading text-headline-md">Current Epoch</h2>
              <span className="rounded bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase text-secondary">Active</span>
            </div>
            <div className="space-y-6 border-l border-outline-variant pl-6">
              {["Proposal Phase", "Voting Period", "Execution Block"].map((item, index) => (
                <div key={item} className="relative">
                  <span className={index < 2 ? "absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-white" : "absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-outline-variant ring-4 ring-white"} />
                  <p className={index < 2 ? "text-label-caps text-secondary" : "text-label-caps text-on-surface-variant"}>
                    {index === 0 ? "Started" : index === 1 ? "Current" : "Upcoming"}
                  </p>
                  <p className="text-body-sm font-medium">{item}</p>
                  <p className="font-mono text-[11px] text-on-surface-variant">
                    {index === 1 ? "Ends in 2d 14h" : index === 0 ? "Oct 24, 08:00 UTC" : "Oct 30, 00:00 UTC"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <section className="rounded-xl bg-primary-container p-6 text-on-primary-container">
            <h2 className="font-heading text-headline-md">My Participation</h2>
            <p className="mb-stack-lg mt-2 text-body-sm text-on-primary-container/70">You have contributed to 14/15 proposals this year.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-label-caps text-on-primary-container/60">Delegated</p><p className="font-mono text-xl font-bold">12,450 NXG</p></div>
              <div><p className="text-label-caps text-on-primary-container/60">Rewards</p><p className="font-mono text-xl font-bold">142.5 NXG</p></div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-gutter lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-stack-sm">
            <h2 className="font-heading text-headline-md">Active Proposals</h2>
            <div className="flex gap-3 text-body-sm">
              <span className="text-on-surface-variant">Filter by:</span>
              <button className="font-medium underline">All</button>
              <button className="text-on-surface-variant">Funding</button>
              <button className="text-on-surface-variant">Policy</button>
            </div>
          </div>

          {proposals.map((proposal, index) => (
            <Card key={proposal.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <span className="rounded-full bg-surface-container px-3 py-1 font-mono text-[11px] text-on-surface-variant">{proposal.id}</span>
                <div className="flex items-center gap-1 text-xs font-medium text-on-secondary-container">
                  {index === 0 ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {proposal.quorum}
                </div>
              </div>
              <h3 className="font-heading text-headline-md">{proposal.title}</h3>
              <p className="mb-stack-lg mt-2 text-body-sm text-on-surface-variant">{proposal.body}</p>
              <div className="mb-stack-lg space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-body-sm"><span className="font-medium text-secondary">Approve</span><span className="font-mono">{proposal.approve}%</span></div>
                  <ProgressBar value={proposal.approve} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-body-sm"><span className="font-medium text-error">Reject</span><span className="font-mono">{proposal.reject}%</span></div>
                  <ProgressBar value={proposal.reject} color="bg-error" />
                </div>
              </div>
              <div className="flex gap-stack-md">
                <button className="flex-1 rounded-lg bg-primary py-3 font-semibold text-on-primary">Vote For</button>
                <button className="flex-1 rounded-lg border border-outline-variant py-3 font-semibold hover:bg-surface-container-low">Vote Against</button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <section className="mt-gutter grid grid-cols-1 gap-gutter md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="mb-stack-md font-heading text-headline-md">Governance Forum Snippets</h2>
          <div className="space-y-4">
            {["The reserve increase is critical given recent TVL spikes on Base.", "Wait for the audit report before voting on the CCIP integration."].map((text, index) => (
              <div key={text} className="rounded-lg border border-outline-variant/30 bg-white p-4 text-body-sm">
                <p className="font-semibold">{index === 0 ? "Alex Rivers" : "Sarah Chen"} <span className="ml-2 font-normal text-on-surface-variant">@delegate</span></p>
                <p className="mt-1 text-on-surface-variant">{text}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="text-center">
          <History className="mx-auto mb-4 text-secondary" size={40} />
          <h2 className="font-heading text-headline-md">Review Constitution</h2>
          <p className="mb-6 mt-2 text-body-sm text-on-surface-variant">Learn about quorum requirements and delegation mechanics.</p>
          <button className="border-b-2 border-primary pb-1 font-semibold">Read Governance Docs</button>
        </Card>
      </section>
    </AppShell>
  );
}
