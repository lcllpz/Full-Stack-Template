import { ArrowUpIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
export default function Home() {
  return (
    <div className="full-screen">
      <h1>Hello World</h1>
      <div className="flex flex-wrap items-center gap-2 md:flex-row">
        <Button variant="outline">Button</Button>
        <Button variant="outline" size="icon" aria-label="Submit">
          <ArrowUpIcon />
        </Button>
      </div>
    </div>
  );
}
