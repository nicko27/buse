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
            new TwigFilter('phone_with_text_format', [$this, 'phoneWithTextFormat']),
        ];
    }

    public function phoneFormat($number)
    {
        return TphUtils::formatPhoneWithZeros($number);
    }

    public function phoneWithTextFormat($text)
    {
        return TphUtils::formatPhoneWithText($text);
    }

    public function truncateMiddle($string, $length)
    {
        return TphUtils::truncateMiddle($string, $length);
    }
}
