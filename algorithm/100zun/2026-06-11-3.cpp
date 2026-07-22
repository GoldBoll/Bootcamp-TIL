// 백준 11724 - 연결 요소의 개수
// https://www.acmicpc.net/problem/11724

// 문제 설명
// 무방향 그래프에서 연결 요소(Connected Component)의 개수를 구하라

// 접근
// - 양방향 인접 리스트 구성
// - 모든 노드 순회 → 미방문 노드에서 DFS 시작할 때마다 ans++

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

vector<int> v[1004];
bool visited[1004];

int dfs(int here)
{
    visited[here] = true;
    int cnt = 1;
    for (int i : v[here])
        if (!visited[i])
            cnt += dfs(i);
    return cnt;
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
        v[a].push_back(b);
        v[b].push_back(a);
    }

    int ans = 0;
    for (int i = 1; i <= n; i++)
        if (!visited[i])
        {
            dfs(i);
            ans++;
        }

    cout << ans << endl;
    return 0;
}
