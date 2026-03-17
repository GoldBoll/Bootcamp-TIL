#pragma once
#include "player.h"
class Magician : public Player {
public:
    Magician(string nickname);
    void attack() override;
    void attack(Monster* monster) override;
};
