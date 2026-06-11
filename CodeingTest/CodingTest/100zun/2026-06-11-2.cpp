// 백준 1325 - 효율적인 해킹
// https://www.acmicpc.net/problem/1325

// 문제 설명
// "A가 B를 신뢰" → B를 해킹하면 A도 해킹됨
// 한 번에 가장 많은 컴퓨터를 해킹할 수 있는 번호를 오름차순 출력

// 접근
// - "A B" 입력 → v[b].push_back(a) (단방향, 역방향 저장)
// - 각 노드에서 dfs() 실행, 반환값(감염 수) 최댓값 추적

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

vector<int> v[10004];
bool visi[10004];

int dfs(int here)
{
    visi[here] = true;
    int token = 1;
    for (int i : v[here])
        if (!visi[i])
            token += dfs(i);
    return token;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m, a, b;
    cin >> n >> m;
    while (m--)
    {
        cin >> a >> b;
        v[b].push_back(a);
    }

    int ans = 0;
    vector<int> result;
    for (int i = 1; i <= n; i++)
    {
        fill(visi + 1, visi + n + 1, false);
        int cnt = dfs(i);
        if (cnt > ans)
        {
            ans = cnt;
            result.clear();
            result.push_back(i);
        }
        else if (cnt == ans)
            result.push_back(i);
    }

    for (int x : result)
        cout << x << ' ';
    cout << endl;
    return 0;
}
