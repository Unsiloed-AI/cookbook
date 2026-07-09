import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function HandCycleExplainer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">How the cycle works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs leading-relaxed text-slate-400">
        <p>Your 8 cards form a queue. Four are in your hand at once, in the order you picked them.</p>
        <p>Playing a card sends it to the back of the queue — the next card in line slides into your hand.</p>
        <p>Order matters: put your cheapest cycle cards early to loop back to your win conditions faster.</p>
      </CardContent>
    </Card>
  );
}
