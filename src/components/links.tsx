'use client';

import Link from 'next/link';
import { Anchor, Button, type AnchorProps, type ButtonProps } from '@mantine/core';

export function AnchorLink({
  href,
  children,
  ...rest
}: AnchorProps & { href: string; children: React.ReactNode }) {
  return (
    <Anchor component={Link} href={href} {...rest}>
      {children}
    </Anchor>
  );
}

export function ButtonLink({
  href,
  children,
  ...rest
}: ButtonProps & { href: string; children: React.ReactNode }) {
  return (
    <Button component={Link} href={href} {...rest}>
      {children}
    </Button>
  );
}
