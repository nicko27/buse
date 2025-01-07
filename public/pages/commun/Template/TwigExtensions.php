<?php

namespace Commun\Template;

use Commun\Utils\TphUtils;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

class TwigExtensions extends AbstractExtension
{
    public function getFilters()
    {
        return [
            new TwigFilter('phone_format', [$this, 'phoneFormat']),
            new TwigFilter('truncate_middle', [$this, 'truncateMiddle']),
            new TwigFilter('strip_accents', [TphUtils::class, 'stripAccents']),
        ];
    }

    public function phoneFormat($number)
    {
        return TphUtils::formatPhoneWithZeros($number);
    }

    public function truncateMiddle($string, $length)
    {
        return TphUtils::truncateMiddle($string, $length);
    }
}
