#include <iostream>
#include <stack>
#include <string>

using namespace std;

string sol(const string &str)
{
  stack<char> stk;
  for (char c : str)
  {
    if (c== '(')
    {
      stk.push(c);
    }
    else
    {
      if (!stk.empty() && stk.top() == '(')
      {
        stk.pop();
      }
      else
      {
        return "NO";
      }
    }
  }
  return stk.empty() ? "YES" : "NO";
}

int main()
{
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  cout.tie(nullptr);

  int t;
  cin >> t;

  while (t--)
  {
    string str;
    cin >> str;
    cout << sol(str) << endl;
  }
  return 0;
}
