#include <iostream>
using namespace std;

int main()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    int arr[100];
    for (int i = 0; i < n; i++)
        cin >> arr[i];

    int v;
    cin >> v;

    int count = 0;
    for (int i = 0; i < n; i++)
        if (arr[i] == v) count++;

    cout << count << "\n";
    return 0;
}
