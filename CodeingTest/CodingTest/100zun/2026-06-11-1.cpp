// 백준 2606 - 바이러스
// https://www.acmicpc.net/problem/2606

// 문제 설명
// 1번 컴퓨터가 웜 바이러스에 걸렸을 때
// 1번과 직접/간접 연결된 컴퓨터 수를 구하라

// 접근
// - 인접 리스트로 그래프 구성
// - DFS로 1번부터 탐색 → 방문한 노드 수 - 1 출력

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

vector<int> v[104];
bool visi[104];

int dfs(int here)
{
    visi[here] = true;
    int cnt = 1;
    for (int i : v[here])
        if (!visi[i])
            cnt += dfs(i);
    return cnt;
}

int main()
{
    int n, m, a, b;
    cin >> n >> m;
    while (m--)
    {
        cin >> a >> b;
        v[a].push_back(b);
        v[b].push_back(a);
    }

    cout << dfs(1) - 1 << endl;
    return 0;
}
