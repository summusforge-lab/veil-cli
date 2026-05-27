import React from 'react';
import { Box, Text } from 'ink';
import type { RiskReport } from '../risk/types.js';
import type { RiskLevel } from '../risk/types.js';

interface DecodedCall {
  functionName: string;
  args: readonly unknown[];
  contractAddress: string;
}

interface ExplainViewProps {
  address: string;
  decoded: DecodedCall | null;
  risk: RiskReport | null;
  loading: boolean;
  error: string | null;
}

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
  critical: 'redBright',
};

const LEVEL_ICON: Record<RiskLevel, string> = {
  low: '✔',
  medium: '⚠',
  high: '✖',
  critical: '☠',
};

function ArgRow({ index, value }: { index: number; value: unknown }) {
  return (
    <Box>
      <Text color="gray">{`  [${index}] `}</Text>
      <Text>{String(value)}</Text>
    </Box>
  );
}

export function ExplainView({ address, decoded, risk, loading, error }: ExplainViewProps) {
  if (loading) {
    return <Text color="cyan">Analyzing {address}…</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Header */}
      <Box>
        <Text bold color="cyan">veil explain </Text>
        <Text color="yellow">{address}</Text>
      </Box>

      {/* Decoded call */}
      {decoded && (
        <Box flexDirection="column">
          <Text bold>Function call</Text>
          <Box>
            <Text color="gray">  fn       </Text>
            <Text color="cyan" bold>{decoded.functionName}</Text>
          </Box>
          <Box>
            <Text color="gray">  contract </Text>
            <Text color="yellow">{decoded.contractAddress}</Text>
          </Box>
          {decoded.args.length > 0 && (
            <Box flexDirection="column">
              <Text color="gray">  args</Text>
              {decoded.args.map((arg, i) => (
                <ArgRow key={i} index={i} value={arg} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Risk report */}
      {risk && (
        <Box flexDirection="column">
          <Text bold>Risk</Text>
          <Box>
            <Text color="gray">  level   </Text>
            <Text color={LEVEL_COLOR[risk.level]}>
              {LEVEL_ICON[risk.level]} {risk.level.toUpperCase()}
            </Text>
          </Box>
          <Box>
            <Text color="gray">  summary </Text>
            <Text>{risk.summary}</Text>
          </Box>
          {risk.flags.map(flag => (
            <Box key={flag.code}>
              <Text color={LEVEL_COLOR[flag.level]}>{`  ${LEVEL_ICON[flag.level]} `}</Text>
              <Text bold>{flag.code}</Text>
              <Text color="gray">{` [${flag.source}] `}</Text>
              <Text dimColor>{flag.description}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
