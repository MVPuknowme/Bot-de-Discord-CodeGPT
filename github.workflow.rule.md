# GitHub Workflow Rule Snippet

```yaml
- name: Enforce Aura Core failure rule
  run: |
    ATTEMPTS=0
    MAX_ATTEMPTS=3

    while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
      ATTEMPTS=$((ATTEMPTS+1))
      echo "Repair attempt $ATTEMPTS"

      if [ -f "user_input.flag" ]; then
        echo "User input detected → proceed"
        exit 0
      fi
    done

    echo "❌ Max repair attempts reached"
    echo "Reference-only enforced until user input is provided"
    exit 1
```
