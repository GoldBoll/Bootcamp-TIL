#include <iostream>
using namespace std;

int main()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    bool submitted[31] = {};  // 1~30 인덱스 사용, 0으로 초기화

    for (int i = 0; i < 28; i++) {
        int x;
        cin >> x;
        submitted[x] = true;
    }

    for (int i = 1; i <= 30; i++)
        if (!submitted[i])
            cout << i << "\n";

    return 0;
}
