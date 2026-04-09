// 백준 10845 - 큐 (Silver IV)
// https://www.acmicpc.net/problem/10845

// 문제 설명
// 정수를 저장하는 큐를 구현한 다음, 입력으로 주어지는 명령을 처리하는 프로그램

// 입력
// 첫째 줄: 명령의 수 N (1 ≤ N ≤ 10,000)
// 각 줄: 명령어 (push X / pop / size / empty / front / back)

// 출력
// push를 제외한 각 명령어마다 해당하는 값 출력
// pop / front / back: 큐가 비어있으면 -1 출력
// empty: 비어있으면 1, 아니면 0 출력
// size: 큐에 들어있는 정수의 개수 출력

// 입출력 예
// 입력:        출력:
// push 1
// push 2
// front        1
// back         2
// size         2
// empty        0
// pop          1
// pop          2
// pop          -1
// size         0
// empty        1
// pop          -1
// push 3
// empty        0
// front        3

#include <iostream>
#include <queue>
#include <string>
using namespace std;

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    queue<int> q;
    string cmd;

    for (int i = 0; i < n; i++)
    {
        cin >> cmd;

        if (cmd == "push")
        {
            int x;
            cin >> x;
            q.push(x);
        }
        else if (cmd == "pop")
        {
            // 풀이 작성
            if(!q.empty() )
            {
                cout << q.front() << endl;
                q.pop();
            }
            else
            {
                cout << -1 << endl;
            }

        }
        else if (cmd == "size")
        {
            cout << q.size() << endl;
        }
        else if (cmd == "empty")
        {
            if(q.empty())   cout << 1 << endl;
            else    cout << 0 << endl;
        }
        else if (cmd == "front")
        {
            cout << q.front() << endl;
        }
        else if (cmd == "back")
        {
            cout << q.back() << endl;
        }
    }

    return 0;
}
