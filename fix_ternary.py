#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix all remaining ternary operators: replace á with ? in conditional expressions
"""

with open('app.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find ternaries with á and fix them
# This regex looks for patterns like: condition á true_value : false_value
import re

# Count á that should be ?
count_before = content.count(' á ')

# Replace patterns like: condition á value1 : value2
# This handles ternaries where á is between condition and the true/false branches
content = re.sub(r'([^?\s])\s+á\s+', r'\1 ? ', content)

# Also handle cases like: showToast('info', `text á text2`);
# where the second á should actually be a ?
content = re.sub(r"(['\"])\s+á\s+(['\"])", r"\1 ? \2", content)

count_after = content.count(' á ')
fixed_count = count_before - count_after

print(f'Fixed ternary operators: {fixed_count}')

with open('app.html', 'w', encoding='utf-8-sig') as f:
    f.write(content)

print('✅ All ternary operators fixed!')
