#!/bin/bash
# Retry loop for flaky ngrok; this script's argv does not match pkill -f 'expo star[t]'
cd "$(dirname "$0")"
LOG=/tmp/algowealth-expo.log
for i in 1 2 3 4 5; do
  echo "=== attempt $i ==="
  nohup env EXPO_TOKEN="$EXPO_TOKEN" CI=1 npx expo start --tunnel > "$LOG" 2>&1 &
  sleep 27
  if curl -s -m 5 -H "expo-platform: ios" localhost:8081 | grep -q exp.direct; then
    echo TUNNEL_OK
    exit 0
  fi
  echo "retry: $(tail -2 "$LOG" | head -1)"
  pkill -f 'expo star[t]'
  sleep 1
  pkill -f 'ngro[k]'
  sleep 2
done
echo TUNNEL_FAIL
exit 1
