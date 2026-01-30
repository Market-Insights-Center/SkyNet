
def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    # We need to ignore strings and comments, strictly speaking, 
    # but for a quick check we can just count raw chars if we assume standard code style.
    # A robust parser is better, but let's try a simple stack first.
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[(':
                stack.append((char, i + 1, j + 1))
            elif char in '}])':
                if not stack:
                    print(f"Unmatched closing '{char}' at line {i+1} col {j+1}")
                    return
                last, li, lj = stack.pop()
                if (last == '{' and char != '}') or \
                   (last == '[' and char != ']') or \
                   (last == '(' and char != ')'):
                    print(f"Mismatch! Opened '{last}' at {li}:{lj}, closed '{char}' at {i+1}:{j+1}")
                    return
    
    if stack:
        print("Unclosed elements remaining:")
        for item in stack:
            print(f"  '{item[0]}' at {item[1]}:{item[2]}")
    else:
        print("All braces balanced.")

if __name__ == "__main__":
    check_balance("src/pages/DatabaseNodes.jsx")
